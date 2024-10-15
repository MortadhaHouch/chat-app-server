let User = require("../models/user")
let jwt = require("jsonwebtoken")
require("dotenv").config();
async function checkUserAuth(req,res,next){
    if(req.cookies.jwt_token){
        let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
        let user = await User.findOne({email});
        const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
        const lastUpdated = new Date(user.updatedAt).getTime();
        if(user){
            if (Date.now() >= lastUpdated + threeDaysInMs) {
                user.isLoggedIn = false;
                await user.save();
            }
            next();
        }else{
            res.json({message:"user not found"})
        }
    }
}
module.exports = checkUserAuth