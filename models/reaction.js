let {model,Schema} = require("mongoose");
let reactionSchema = new Schema({
    content:{
        type:String,
        required:true,
    },
    addedOn:{
        type:String,
        default:Date.now().toString()
    },
    from:{
        type:Schema.Types.ObjectId
    }
})
module.exports = model("reaction", reactionSchema);