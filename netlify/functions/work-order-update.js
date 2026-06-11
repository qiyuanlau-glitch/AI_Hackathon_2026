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

function getMongoConfig(){
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME;
  const collection = process.env.MONGODB_WORK_ORDER_COLLECTION || process.env.MONGODB_COLLECTION || 'work_orders';
  const missing = [];
  if (!uri) missing.push('MONGODB_URI');
  if (!database) missing.push('MONGODB_DATABASE');
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
  if (event.httpMethod !== 'POST'){
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const input = parseJsonBody(event);
    const workOrderId = ensureRequiredString(input.workOrderId, 'workOrderId');

    const updateFields = {
      desc: ensureRequiredString(input.desc, 'desc'),
      serviceCategoryName: ensureRequiredString(input.serviceCategoryName, 'serviceCategoryName'),
      serviceProblemName: ensureRequiredString(input.serviceProblemName, 'serviceProblemName'),
      serviceCodeName: ensureRequiredString(input.serviceCodeName, 'serviceCodeName'),
      unit: ensureRequiredString(input.unit, 'unit'),
      locationAddress: ensureRequiredString(input.locationAddress, 'locationAddress'),
      inspection: Boolean(input.inspection),
      updatedAt: new Date().toISOString(),
    };

    const uploads = sanitizeUploads(input.uploads);
    if (uploads.length) updateFields.uploads = uploads;

    const collection = await getCollection();
    const result = await collection.updateOne(
      { workOrderId },
      { $set: updateFields }
    );

    if (!result.matchedCount){
      return jsonResponse(404, { ok: false, error: `Work order not found: ${workOrderId}` });
    }

    return jsonResponse(200, {
      ok: true,
      workOrderId,
      updated: result.modifiedCount > 0,
    });
  } catch (error) {
    return jsonResponse(error.statusCode || 500, {
      ok: false,
      error: error.message || 'Failed to update work order.',
    });
  }
};
