import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadFile = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(
            localFilePath, {
            resource_type: 'auto'
        }
        )
        console.log("File is Uploaded on Cloudinary",
            response.url);
        return response
    } catch (error) {
        fs.unlink(localFilePath) // for removing the locally saved temporary file as upload is got failed....
        return null;
    }
}

export { uploadFile }