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

function parseJsonBody(event){
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    throw error;
  }
}

function ensureRequiredString(value, field){
  if (typeof value !== 'string' || !value.trim()){
    const error = new Error(`"${field}" is required.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function sanitizeUploads(value){
  if (!Array.isArray(value)) return [];
  return value
    .map(item => ({
      uploadId: typeof item?.uploadId === 'string' ? item.uploadId.trim() : '',
      fileName: typeof item?.fileName === 'string' ? item.fileName.trim() : '',
      filePath: typeof item?.filePath === 'string' ? item.filePath.trim() : '',
    }))
    .filter(item => item.uploadId && item.fileName && item.filePath);
}

function buildDocument(payload){
  return {
    workOrderId: ensureRequiredString(payload.workOrderId, 'workOrderId'),
    serviceCategoryName: ensureRequiredString(payload.serviceCategoryName, 'serviceCategoryName'),
    serviceProblemName: ensureRequiredString(payload.serviceProblemName, 'serviceProblemName'),
    serviceCodeName: ensureRequiredString(payload.serviceCodeName, 'serviceCodeName'),
    locationAddress: ensureRequiredString(payload.locationAddress, 'locationAddress'),
    createdAt: ensureRequiredString(payload.createdAt, 'createdAt'),
    uploads: sanitizeUploads(payload.uploads),
    insertedAt: new Date().toISOString(),
  };
}

async function insertWorkOrder(document){
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME;
  const collectionName = process.env.MONGODB_WORK_ORDER_COLLECTION || process.env.MONGODB_COLLECTION || 'work_orders';

  const missing = [];
  if (!uri) missing.push('MONGODB_URI');
  if (!database) missing.push('MONGODB_DATABASE');

  if (missing.length){
    const error = new Error(`MongoDB environment variables are not fully configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }

  if (!mongoClientPromise){
    mongoClientPromise = MongoClient.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
  }
  const client = await mongoClientPromise;
  const db = client.db(database);
  const collection = db.collection(collectionName);
  const result = await collection.insertOne(document);

  return {
    insertedId: result.insertedId ? String(result.insertedId) : null,
    collection: collectionName,
  };
}

exports.handler = async function handler(event){
  if (event.httpMethod === 'OPTIONS'){
    return jsonResponse(204, '');
  }

  if (event.httpMethod !== 'POST'){
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const payload = parseJsonBody(event);
    const document = buildDocument(payload);
    const result = await insertWorkOrder(document);
    return jsonResponse(200, {
      ok: true,
      id: result?.insertedId || null,
      collection: result?.collection || process.env.MONGODB_WORK_ORDER_COLLECTION || 'work_orders',
      workOrderId: document.workOrderId,
    });
  } catch (error) {
    return jsonResponse(error.statusCode || 500, {
      ok: false,
      error: error.message || 'Failed to create work order.',
    });
  }
};
