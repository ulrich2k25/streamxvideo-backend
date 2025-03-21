const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);  // Créer un hash pour le mot de passe
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);  // Comparer le mot de passe
};

module.exports = mongoose.model("User", userSchema);
