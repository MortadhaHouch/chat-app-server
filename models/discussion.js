let {Schema,model} = require("mongoose");
let discussionSchema = new Schema({
    members:{
        type:[Schema.ObjectId],
    },
    messages:{
        type:[Schema.ObjectId],
    },
})
module.exports = model("discussion",discussionSchema)