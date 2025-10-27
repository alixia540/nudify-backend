import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  credits: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);
export default User;
