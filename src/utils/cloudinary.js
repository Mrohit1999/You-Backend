import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// console.log("CLOUDINARY ENV CHECK:", {
//   name: process.env.CLOUDINARY_CLOUD_NAME,
//   key: process.env.CLOUDINARY_API_KEY,
//   secret: process.env.CLOUDINARY_API_SECRET ? "✅ present" : "❌ missing",
// });
const uploadFile = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    console.log("File is Successfully Uploaded on Cloudinary:", response.url);

    //  delete local temp file after success
    fs.unlink(localFilePath, (err) => {
      if (err) console.log("Local file delete Failed:", err.message);
    });

    return response;
  } catch (error) {
    console.log("Cloudinary upload Failed:", error.message);

    //still try to delete local file
    if (localFilePath) {
      fs.unlink(localFilePath, (err) => {
        if (err) console.log("Local file delete Failed:", err.message);
      });
    }

    return null;
  }
};

export { uploadFile };



