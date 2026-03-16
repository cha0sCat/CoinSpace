import mongodb from 'mongodb';
const { MongoClient } = mongodb;

let database;

if (process.env.DB_CONNECT && process.env.DB_NAME) {
  const client = await MongoClient.connect(process.env.DB_CONNECT, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  database = client.db(process.env.DB_NAME);

  await database.collection('cache').createIndexes([
    { key: { expire: 1 }, background: true, expireAfterSeconds: 0 },
  ]);
} else {
  console.warn('DB_CONNECT/DB_NAME not set, using in-memory cache only');
}

const db = {
  collection(name) {
    if (!database) {
      throw new Error(`Database unavailable for collection '${name}'`);
    }
    return database.collection(name);
  },
};

const memoryCache = new Map();

export function dbMemoize(target, { key, ttl }) {
  if (!key) throw new TypeError('"key" is required');
  if (!ttl) throw new TypeError('"ttl" is required');
  let promise;
  return new Proxy(target, {
    apply(target, thisArg, argumentsList) {
      if (!promise) {
        promise = (async () => {
          try {
            if (!database) {
              const item = memoryCache.get(key);
              if (item && item.expire > Date.now()) {
                return item.value;
              }
              const result = await Reflect.apply(target, thisArg, argumentsList);
              memoryCache.set(key, {
                value: result,
                expire: Date.now() + ttl * 1000,
              });
              return result;
            }
            const value = await database
              .collection('cache')
              .findOne({ _id: `cache-${key}` })
              .then((doc) => doc && JSON.parse(doc.value));
            if (value) {
              return value;
            }
            const result = await Reflect.apply(target, thisArg, argumentsList);
            try {
              return result;
            } finally {
              await database
                .collection('cache')
                .updateOne({
                  _id: `cache-${key}`,
                }, {
                  $set: {
                    value: JSON.stringify(result),
                    expire: new Date(Date.now() + ttl * 1000),
                  },
                }, { upsert: true });
            }
          } finally {
            promise = undefined;
          }
        })();
      }
      return promise;
    },
  });
}

export default db;
