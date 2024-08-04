let {model,Schema} = require("mongoose");
let fileSchema = new Schema({
    path:{
        type:String,
        required:true
    },
})
module.exports = model("file",fileSchema);