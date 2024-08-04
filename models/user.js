let {model,Schema} = require("mongoose");
let bcrypt = require("bcrypt");
let userSchema = new Schema({
    firstName: {
        type:String,
        required: true,
    },
    lastName: {
        type:String,
        required: true,
    },
    email:{
        type:String,
        required: true,
    },
    password:{
        type:String,
        required: true,
    },
    currentIp:{
        type:String,
        required: true,
    },
    dateOfBirth:{
        type:String,
        required: true,
    },
    isLoggedIn:{
        type:Boolean,
        required: true,
        default:false
    },
    avatar:{
        type:Schema.Types.ObjectId,
        required: true,
    },
    isCalling:{
        type:Boolean,
        required: true,
        default:false
    },
    blockedUsers:{
        type:[Schema.Types.ObjectId]
    },
    friends:{
        type:[Schema.Types.ObjectId]
    }
})
userSchema.pre("save",async function(){
    try {
        let salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password,salt);
    } catch (error) {
        console.log(error);
    }
})
module.exports = model("users",userSchema);