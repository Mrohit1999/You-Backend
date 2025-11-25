import connectDB from "./db/database.js";
import dotenv from "dotenv";
dotenv.config();

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at port:${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("MongoDB Connection Failed...",err);
    
})