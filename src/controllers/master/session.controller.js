var myDbDefinesHelper = require('./mydbdefines.helper')


module.exports = (member, req, res, next, cb) => {
	switch (req.method) {
		case 'PUT':
		case 'POST':
			if(req.params.param1 == undefined) {
				exports.newSession(member, req, res, next, cb)
			} else if(req.params.param1.toLowerCase() == 'changedb') {
				exports.changeDb(member, req, res, next, cb)
			} else {
				error.param1(req, next)
			}
			break

		default:
			error.method(req, next)
			break
	}
}


exports.newSession = function(member, req, res, next, cb) {
	exports.checkMember(member, req, res, next, (memberDoc) => {
		let newSession = db.sessions({
			memberId: member._id,
			username: member.username,
			role: member.role,
			userAgent: req.headers['user-agent'] || '',
			ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
			token: (req.body || {}).token || (req.query || {}).token || (req.headers || {})['x-access-token'] || (req.headers || {})['token'] || '',
			dbId: (req.body || {}).db || (req.query || {}).db || '',
			dbName: '',
			mId: ''
		})

		let lastLoginDbId = ''
		db.sessions.find({ memberId: member._id }).sort({ _id: -1 }).limit(1).exec((err, sonGiris) => {
			if(dberr(err, next)) {
				if(sonGiris.length > 0)
					lastLoginDbId = sonGiris[0].dbId

				myDbDefinesHelper.getList(member, req, res, next, (databases) => {
					newSession.save((err, newSession2) => {
						if(dberr(err, next)) {
							let sessionData = newSession2.toJSON()
							let dbObj = null
							sessionData.version = portalConstants.version
							sessionData.staticValues = portalConstants.staticValues
							sessionData.pages = portalConstants.pages
							sessionData.databases = databases
							sessionData.menu = []
							sessionData.settings = []

							if(lastLoginDbId != '') {
								databases.forEach((e) => {
									if(e._id == lastLoginDbId) {
										dbObj = e
										return
									}
								})
							}
							if(!dbObj && databases.length > 0)
								dbObj = databases[databases.length - 1]


							if(dbObj) {
								sessionData.dbId = dbObj._id
								sessionData.dbName = dbObj.dbName
								sessionData.menu = menuMixOneDatabase(portalConstants.mainMenu, dbObj)
							}
							dbSettings(dbObj._id, next, (settings) => {
								sessionData.settings = settings
								cb(sessionData)
							})

						}
					})
				})

			}
		})
	})

}

exports.changeDb = function(member, req, res, next, cb) {
	let dbId = (req.body || {}).db || (req.query || {}).db || ''
	let sessionId = (req.body || {}).sid || (req.query || {}).sid || ''

	if(dbId == '')
		return next({ code: 'WRONG_PARAMETER', message: 'db parametresi gereklidir' })

	if(sessionId == '')
		return next({ code: 'WRONG_PARAMETER', message: 'sid parametresi gereklidir' })
	db.sessions.findOne({ memberId: member._id, _id: sessionId }, (err, sessionDoc) => {
		if(dberr(err, next)) {
			if(sessionDoc == null)
				return next({ code: 'SESSION_NOT_FOUND', message: 'Oturum sonlandırılmış. Tekrar giriş yapınız.' })
			myDbDefinesHelper.getList(member, req, res, next, (databases) => {
				let dbObj = databases.find(e => e._id == dbId)
				if(!dbObj)
					return next({ code: 'DATABASE_NOT_FOUND', message: `${dbId} Veri ambarı bulunamadı` })
				let sessionData = sessionDoc.toJSON()
				sessionData.databases = databases
				sessionData.dbId = dbObj._id
				sessionData.dbName = dbObj.dbName
				sessionData.version = portalConstants.version
				sessionData.staticValues = portalConstants.staticValues
				sessionData.pages = portalConstants.pages
				sessionData.menu = menuMixOneDatabase(portalConstants.mainMenu, dbObj)
				dbSettings(dbObj._id, next, (settings) => {
					sessionData.settings = settings
					cb(sessionData)
				})
			})
		}
	})
}


function saveSessionDoc(member, data, req, res, next, cb) {
	let filter = { memberId: member._id }

	db.sessions.find(filter).sort({ _id: -1 }).limit(1).exec((err, sonGiris) => {
		if(dberr(err, next)) {
			if(sonGiris.length > 0) {
				data.dbId = (sonGiris[0].dbId || '')
			}
			if(data.dbId == '') {
				if(data.databases.length > 0) {
					let db = data.databases[data.databases.length - 1]
					data.dbId = db._id.toString()
					data.dbName = db.dbName
					// data.menu = menuModule(mainMenu, e.owner.modules)
					// data.settings = []
				}
			} else {
				data.databases.forEach((e) => {
					if(e._id.toString() == data.dbId) {
						data.dbId = e._id.toString()
						data.dbName = e.dbName
						data.menu = menuModule(mainMenu, e.owner.modules)
						data.settings = []
					}
				})
			}
		}

		let newDoc = new db.sessions(data)

		if(!epValidateSync(newDoc, next)) return

		dbSettings(newDoc.dbId, next, (settings) => {
			newDoc.settings = settings
			newDoc.save((err, newDoc2) => {
				if(dberr(err, next)) {
					cb(newDoc2.toJSON())
				}
			})
		})
	})
}

function dbSettings(dbId, next, cb) {
	if(!dbId)
		return cb([])
	repoDbModel(dbId, (err, dbModel) => {
		if(dberr(err, next)) {
			let populate = [
				{ path: 'programButtons.program', select: '_id name type passive' },
				{ path: 'print.form', select: '_id name module isDefault passive' },
				{ path: 'print.list', select: '_id name module isDefault passive' }
			]

			dbModel.settings.find({}).populate(populate).exec((err, docs) => {
				if(dberr(err, next)) {
					cb(docs)
				}
			})
		}
	})
}

exports.checkMember = function(member, req, res, next, cb) {
	db.portal_members.findOne({ _id: member._id }, (err, doc) => {
		if(dberr(err, next)) {
			if(doc == null) {
				let newDoc = new db.portal_members(member)
				if(!epValidateSync(newDoc, next))
					return
				newDoc.modules = portalModules
				newDoc.save((err, newDoc2) => {
					if(dberr(err, next)) {
						cb(newDoc2)
					}
				})
			} else {
				if(!doc.modules) {
					doc.modules = portalModules
					doc.save()
				}
				cb(doc)
			}
		}
	})
}


function menuMixDatabases(menu, databases) {
	databases.forEach((d) => {
		var menu1 = clone(menu)
		var menu2 = []
		menu1.forEach((e) => {
			e = menuModule(e, d.owner.modules)
			if(e != undefined) {
				menu2.push(clone(e))
			}
		})

		d['menu'] = menu2
	})
	return databases
}

function menuMixOneDatabase(menu, database) {
	var menu1 = clone(menu)
	var menu2 = []
	menu1.forEach((e) => {
		e = menuModule(e, database.owner.modules)
		if(e != undefined) {
			menu2.push(clone(e))
		}
	})

	return menu2
}

function menuModule(menu, modules) {
	if(menu.nodes == undefined) {
		if(menu.module != undefined) {
			var dizi = menu.module.split('.')
			var bShow = false
			if(modules[dizi[0]]) {
				if(dizi.length > 1) {
					if(modules[dizi[0]][dizi[1]]) {
						if(dizi.length > 2) {
							if(modules[dizi[0]][dizi[1]][dizi[2]]) {
								if(dizi.length > 3) {
									if(modules[dizi[0]][dizi[1]][dizi[2]][dizi[3]]) {
										bShow = true
									}
								} else {
									bShow = true
								}
							}
						} else {
							bShow = true
						}
					}
				} else {
					bShow = true
				}
			}
			if(bShow) {
				return menu
			} else {
				return undefined
			}
		} else {
			return menu
		}
	} else {
		var bNodeVar = false
		var nodes = []
		menu.nodes.forEach((e) => {
			e = menuModule(e, modules)
			if(e != undefined)
				nodes.push(clone(e))
		})
		if(nodes.length > 0) {
			menu.nodes = nodes
			return menu
		} else {
			return undefined
		}

	}
}