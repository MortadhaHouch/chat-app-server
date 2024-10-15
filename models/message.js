let {model,Schema} = require("mongoose");
let messageSchema = new Schema({
    content:{
        type:String,
        required:true
    },
    from:{
        type:Schema.Types.ObjectId,
        required:true
    },
    to:{
        type:[Schema.Types.ObjectId],
        required:true
    },
    isDeleted:{
        type:Boolean,
        default:false
    },
    files:{
        type:[Schema.Types.ObjectId],
    },
    isSeen:{
        type:Boolean,
        default:false
    },
    reactions:{
        type:[Schema.Types.ObjectId],
    }
},{timestamps:true});
module.exports = model("Message",messageSchema)