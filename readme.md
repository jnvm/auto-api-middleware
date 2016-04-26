# Auto API Middleware

Do you want a subset of the methods on your backend classes/objects/models to be `fetch`-able or `$.ajax`-able on the front without having to write explicit express routes?

Then add them to your router like so:

```javascript
.all("/json(/:model)?(/:verb)?", require("auto-api-middleware")({source:Model}) )
```

##Example
Say a Model was passed in that looked like this:

```javascript
var Model={
    book:{
        getPage(num){}
        ,getWordsByFrequency(isbn){}
        ,fetchCover(isbn){}
    }
    ,scheduler:{
        setAppointment(){}
        ,getEventsInRange(start,end){}
    }
    ,user:{
        get(key){}
        ,update(key,changes){}
        ,columns:{name:'',created:'',password:'',email:''}
    }
}
```
That would create these JSON routes:
```
/json/book/getPage
/json/book/getWordsByFrequency
/json/book/fetchCover
/json/scheduler/setAppointment
/json/scheduler/getEventsInRange
/json/user/get
/json/user/update
/json/user/columns
```
All routes for functions with named inputs would require them as query parameters like so:

```javascript
$.ajax({url:"/json/scheduler/getEventsInRange",data:{start:"Tuesday",end:"Friday"}})
//or
fetch("/json/scheduler/getEventsInRange?start=Tuesday&end=Friday")
```

These flow types are understood for functions:
* (async) If a function signature has an input that is named in `callbackNames` (see options below), it will use that
* (promise) If a function returns a promise, it will send the resolution
* (sync) If a function returns anything else, that value is sent

Now, maybe you:
* don't want user.update to be available
* or want to restrict it to only be in the scope of the session's user
* or want to only take methods containing certain words

The options below allow that.

## Options
```javascript
//note the path is left to you to define, but :model and :verb are required somehow.
//this path allows both to be optional, which makes it easier to beHelpful
.all("/json(/:model)?(/:verb)?", require("auto-api-middleware")({
    //opt:default value if you don't provide one
    source:{} //should be shaped like {model1:{verbs},model2:{verbs},...}; compose as you'd like. Only take things at M.json.*?
    ,beHelpful:false // suggest models, verbs, and inputs necessary for incomplete requests. Keep off in production.
    ,filter(key,val){ //restrict which model properties to make available. Return truthy here to keep.
        //key=verb, val=source[model][verb] in these cases
        return !(key[0]=='_' || val.priv || val.private) //recall properties can be assigned to functions, if you want
    }
    ,methodMap(key,value){  // which HTTP method to use for which methods.
        return _.castArray(
            (key.match(/^(get|gather|find|fetch)/gi) || !_.isFunction(value) ? "GET"
            : key.match(/POST|GET|PUT|PATCH|DELETE/i)
            ) || "POST"
        ).first()
    }
    ,before(req,res){} // sync run before verb. Say, force anything called user_id to be the session's user_id...
    ,after(req,res,returned){} //sync run after verb to allow transforms of returned value before responding
    ,callbackNames:["done","next","then"] //place the res.send callback in the first input named one of these
                                          // (otherwise assume promise or sync result)
}) )
```