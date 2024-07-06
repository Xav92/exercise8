import { MongoClient, ObjectId } from 'mongodb';

let _db = null;

const newId = (str) => new ObjectId(str);

async function connect() {
  if (!_db) {
    const connectionString = process.env.DB_URL;
    const DbNAME = process.env.DB_NAME;
    const client = new MongoClient(connectionString);

    try {
      await client.connect();
      console.log("Connected to the MongoDB database");
      _db = client.db(DbNAME);
    } catch (err) {
      console.error("Failed to connect to MongoDB", err);
      throw err;
    }
  }
  return _db;
}

async function createUser(user) {
  try {
    const db = await connect();
    const result = await db.collection('User').insertOne(user);
    console.log("User created:", result);
    return result;
  } catch (err) {
    console.error("Failed to create user", err);
  }
}

async function getUserById(id) {
  try {
    const db = await connect();
    const result = await db.collection('User').findOne({ id: id });
    console.log("User found:", result);
    return result;
  } catch (err) {
    console.error("Failed to get user by ID", err);
  }
}

export { createUser, newId, getUserById };

