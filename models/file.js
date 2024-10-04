let {model,Schema} = require("mongoose");
let fileSchema = new Schema({
    path:{
        type:String,
        required:true
    },
    name:{
        type:String,
        required:false,
        default:""
    },
    size:{
        type:Number,
        required:false,
    }
},{timestamps:true});
module.exports = model("file",fileSchema);