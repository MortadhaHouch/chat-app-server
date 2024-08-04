let {model,Schema} = require("mongoose");
let roomSchema = new Schema({
    users:{
        type:[Schema.Types.ObjectId]
    },
    name:{
        type:String,
        required:true
    },
    avatar:{
        type:Schema.Types.ObjectId
    },
    messages:{
        type:[Schema.Types.ObjectId]
    }
})




module.exports = model("room",roomSchema);