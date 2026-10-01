exports.auth=(req,res,next)=>{if(!req.session.user)return res.redirect('/login');if(req.session.user.must_change_password && req.path!=='/force-password' && req.path!=='/logout')return res.redirect('/force-password');next()};
exports.admin=(req,res,next)=>req.session.user?.role==='ADMIN'?next():res.status(403).render('error',{code:403,message:'Keine Berechtigung.'});
