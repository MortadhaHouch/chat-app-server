let {Schema,model} = require("mongoose")
let requestSchema = new Schema({
    from:{
        type:Schema.ObjectId,
        required: true
    },
    to:{
        type:Schema.ObjectId,
        required: true
    },
    isSent:{
        type:Boolean,
        required: true,
        default: false
    },
    isApproved:{
        type:Boolean,
        required: true,
        default: false    
    },
    isSeen:{
        type:Boolean,
        required: true,
        default: false  
    },
    isCancelled:{
        type:Boolean,
        required: true,
        default: false
    }
},{timestamps:true})
module.exports = model("Request",requestSchema);