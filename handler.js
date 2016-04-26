module.exports=function init(opts){
    var _=require("lodash")
        ,introspect=require("introspect-fun")

    _.defaults(opts,{
        beHelpful:false
        ,methodMap:(key,value)=>_.castArray(
            (key.match(/^(get|gather|find|fetch)/gi) || !_.isFunction(value) ? "GET"
            : key.match(/POST|GET|PUT|PATCH|DELETE/i)
            ) || "POST").first()
        ,filter:(key,val)=>!(key[0]=='_' || val.priv || val.private)
        ,source:{}
        ,before:()=>{}
        ,after:()=>{}
        ,callbackNames:["done","next","then"]
    })

    //apply filter
    var validVerb=_.keyBy(
        _.flatten(
            _.keys(opts.source)
                .map(mdl=>_.keys(opts.source[mdl])
                    .filter(k=>opts.filter(k,opts.source[mdl][k]))
                )
        )
    )

    var Model=opts.source
        ,beHelpful=opts.beHelpful
        ,perform=function(req,res,target,done){
            if(typeof target !=='function') done(target)
            else{
                //plug in inputs from req.query
                //consider addressing non-last-input callback
                var fxn=target
                    ,args=introspect(fxn)
                    ,callback=_.intersection(opts.callbackNames,args)[0]
                    ,need=callback ? args.filter(n=>n!=callback) : args
                    ,given=need.map(n=>req.query[n]).filter(v=>v!==undefined)
                if(_.intersection(need,_.keys(req.query)).length!=need.length) res.status(400).json(beHelpful? "need: "+need : "arity mismatch")
                try{
                    if(callback) fxn(...given.concat( done ))
                    else{
                        var result=fxn(...given)
                        if(result.constructor == (new Promise(()=>{})).constructor)
                            result.then(resolved=>done(resolved))
                                .catch(err=>{
                                    res.status(500)
                                    done({error})
                                })
                        else done(result)
                    }
                }
                catch(error){res.status(500).json({error})}
            }
        }

    return function(req,res,next){
        var {model,verb}=req.params
            ,error
            ,method
             if(beHelpful && !model) res.json(_.keys(_.pickBy(Model,_.isObject)))
        else if(beHelpful && !verb) res.json(_.keys(Model[model]).filter(v=>validVerb[v]))
        else{
            //console.log({model,verb})
            if(!model || !Model[model]) error=`${model} unavailable`
            else if(verb && (!Model[model][verb] || !validVerb[verb])) error=`${model}.${verb} unavailable`
            else if(verb && model && (method=opts.methodMap(verb,Model[model][verb])) !== req.method) error=`expected method ${method}`
            if(error) res.status(400).json({error:beHelpful?error:""})
            else{
                opts.before(req,res)
                perform(req,res,Model[model][verb],returned=>{
                    opts.after(req,res,returned)
                    res.json(returned)
                })
            }
        }
    }
}