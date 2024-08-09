let {Schema,model} = require("mongoose");
let notificationSchema = new Schema({
    content:{
        type:String,
        required:true,
    },
    for:{
        type:Schema.ObjectId,
        required:true,
    },
    handler:{
        type:Schema.ObjectId,
        required:true,
    }
},{timestamps:true});
module.exports = model("notification",notificationSchema)