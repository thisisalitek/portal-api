module.exports = (dbModel, member, req, res, next, cb)=>{
	switch(req.method){
		case 'GET':
		if(req.params.param1!=undefined){
			getOne(dbModel, member, req, res, next, cb)
		}else{
			getList(dbModel, member, req, res, next, cb)
		}
		break
		case 'POST':
		post(dbModel, member, req, res, next, cb)
		break
		case 'PUT':
		put(dbModel, member, req, res, next, cb)
		break
		case 'DELETE':
		deleteItem(dbModel, member, req, res, next, cb)
		break
		default:
		error.method(req, next)
		break
	}

}


function getList(dbModel, member, req, res, next, cb){
	var options={
		page: (req.query.page || 1)
	}

	if((req.query.pageSize || req.query.limit || '')!='')
		options['limit']=req.query.pageSize || req.query.limit


	var filter = {}

	if((req.query.useMaterialInput || '')!='')
		filter['useMaterialInput']=req.query.useMaterialInput

	if((req.query.useMaterialOutput || '')!='')
		filter['useMaterialOutput']=req.query.useMaterialOutput

	if((req.query.useMachine || '')!='')
		filter['useMachine']=req.query.useMachine

	if((req.query.useMold || '')!='')
		filter['useMold']=req.query.useMold

	if((req.query.passive || '')!='')
		filter['passive']=req.query.passive

	if((req.query.name || '')!='')
		filter['name']={ $regex: '.*' + req.query.name + '.*' ,$options: 'i' }

	dbModel.mrp_process_steps.paginate(filter,options,(err, resp)=>{
		if(dberr(err,next)){
			cb(resp)
		}
	})
}


function getOne(dbModel, member, req, res, next, cb){
	dbModel.mrp_process_steps.findOne({_id:req.params.param1},(err,doc)=>{
		if(dberr(err,next)){
			cb(doc)
		}
	})
}

function post(dbModel, member, req, res, next, cb){
	var data = req.body || {}
	data._id=undefined

	var newDoc = new dbModel.mrp_process_steps(data)
	if(!epValidateSync(newDoc,next))
		return
	newDoc.save((err, newDoc2)=>{
		if(dberr(err,next)){
			cb(newDoc2)
		} 
	})


}

function put(dbModel, member, req, res, next, cb){
	if(req.params.param1==undefined)
		return error.param1(req, next)

	var data = req.body || {}

	data._id = req.params.param1
	data.modifiedDate = new Date()

	dbModel.mrp_process_steps.findOne({ _id: data._id},(err,doc)=>{
		if(dberr(err,next)){
			if(dbnull(doc,next)){
				var doc2 = Object.assign(doc, data)
				var newDoc = new dbModel.mrp_process_steps(doc2)
				if(!epValidateSync(newDoc,next))
					return
				newDoc.save((err, newDoc2)=>{
					if(dberr(err,next)){
						cb(newDoc2)
					} 
				})

			}
		}
	})
}

function deleteItem(dbModel, member, req, res, next, cb){
	if(req.params.param1==undefined)
		return error.param1(req, next)
	var data = req.body || {}
	data._id = req.params.param1
	dbModel.mrp_process_steps.removeOne(member,{ _id: data._id},(err,doc)=>{
		if(dberr(err,next)){
			cb(null)
		}
	})

}
