let mongoose = require("mongoose");
let client = null;
let dotenv = require("dotenv");
dotenv.config();
async function connectToDB(){
    try {
        client = await mongoose.connect(process.env.MONGOOSE_URI);
        console.log("connected to db");
        return client;
    } catch (error) {
        console.log(error);
    }
}
module.exports = connectToDB;