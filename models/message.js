let {model,Schema} = require("mongoose");
let messageSchema = new Schema({
    content:{
        type:String,
        required:true
    },
    addedOn:{
        type:String,
        default:Date.now().toString()
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
})
module.exports = model("Message",messageSchema)