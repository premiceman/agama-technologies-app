const mongoose = require('mongoose');

afterAll(async () => {
  await mongoose.disconnect();
});
