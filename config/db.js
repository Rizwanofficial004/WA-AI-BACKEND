const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Cleanup: drop obsolete unique index on businesses.email if it exists.
    // This can happen if the schema previously had an `email` field with a unique index.
    try {
      const collection = conn.connection.db.collection('businesses');
      const indexes = await collection.indexes();
      const emailIndex = indexes.find(
        (idx) =>
          idx.key &&
          idx.key.email === 1 &&
          idx.unique === true
      );

      if (emailIndex) {
        await collection.dropIndex(emailIndex.name);
        console.log(`Dropped obsolete index on businesses: ${emailIndex.name}`);
      }
    } catch (indexError) {
      // Non-fatal: app can still run even if index cleanup fails.
      console.warn('Index cleanup warning:', indexError.message || indexError);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;