const { corsHeaders } = require('../../agent-proxy-core.cjs');
const { MongoClient } = require('mongodb');

let mongoClientPromise = null;

function jsonResponse(statusCode, body){
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function getMongoConfig(){
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || process.env.MONGO_URL;
  const database = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || process.env.MONGO_DB || process.env.DB_NAME;
  const collection = process.env.MONGODB_WORK_ORDER_COLLECTION || process.env.MONGODB_COLLECTION || 'work_orders';
  const missing = [];
  if (!uri) missing.push('MONGODB_URI (or MONGO_URI / MONGODB_URL)');
  if (!database) missing.push('MONGODB_DATABASE (or MONGODB_DB_NAME / MONGO_DB)');
  if (missing.length){
    const error = new Error(`MongoDB environment variables are not fully configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
  return { uri, database, collection };
}

async function getCollection(){
  const cfg = getMongoConfig();
  if (!mongoClientPromise){
    mongoClientPromise = MongoClient.connect(cfg.uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
  }
  const client = await mongoClientPromise;
  return client.db(cfg.database).collection(cfg.collection);
}

exports.handler = async function handler(event){
  if (event.httpMethod === 'OPTIONS'){
    return jsonResponse(204, '');
  }
  if (event.httpMethod !== 'GET'){
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const collection = await getCollection();
    const items = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ insertedAt: -1, createdAt: -1 })
      .limit(50)
      .toArray();

    return jsonResponse(200, { ok: true, items });
  } catch (error) {
    return jsonResponse(error.statusCode || 500, {
      ok: false,
      error: error.message || 'Failed to load work orders.',
    });
  }
};
