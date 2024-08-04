let {model,Schema} = require("mongoose");
let callSchema = new Schema({
    madeOn:{
        type:String,
        default:Date.now().toString()
    },
    isActive:{
        type:Boolean,
        default:false
    },
    duration:{
        type:Number,
    }
});
module.exports = model("call",callSchema);