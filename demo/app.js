/**
 * This a demonstration of using Wajez API to create a REST API
 */
const mongoose = require('mongoose')
const express = require('express')
const bodyParser = require('body-parser')
const wz = require('../src')
const {
  connect, clean, User, Account,
  Category, Post, Comment, Tag,
  relations
} = require('../test/db')

// these constants should be on env vars or some config file
const secret = 'OhhVeryVerySecure!'

// connecting to database
connect().catch(err => console.error('Error while connecting to DB', err))

// create the app
const app = express()

// body parser is required since the routes generated by wajez-api
// assume that req.body already contains the parsed json
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}))
app.use(bodyParser.json({limit: '50mb'}))

// define authentication middleware
const auth = wz.auth({secret, requestProperty: 'account'}, Account)

// a middleware that ensures the authenticated account is an admin
const isAdmin = (req, res, next) => {
  if (req.account && req.account.type === 'admin')
    return next()
  next({name: 'UnauthorizedError'})
}

// add login route
// POST /auth
// this will receive the `email` and `password`
// of an account an return a response of format
// {token: 'auth-token'}
app.use(wz.router([
  wz.login(secret, Account, ['email', 'password'], {
    uri: '/auth',
    actions: [
      // checking if the account is active before returning the token
      wz.beforeConvert((req, res, next) => {
        const account = wz.getData(req)[0]
        if (account && !account.active)
          return next({name: 'InactiveAccount'})
        next()
      })
    ]
  })
]))

// add Account routes
app.use(wz.router(wz.resource(Account, {
  relations,
  defaults: { // this applies to all routes
    converter: { // ensure the password is hidden
      password: _ => undefined
    },
    actions: [ // ensure an admin is authenticated
      wz.beforeQuery([auth, isAdmin])
    ]
  }
})))

// add User routes
app.use(wz.router(wz.resource(User, {
  relations,
  edit: {
    actions: [
      // only admin or the user itself can update a user.
      wz.beforeQuery([
        auth,
        (req, res, next) => {
          if (req.account.type === 'admin' || (req.account.type === 'user' && req.params.id === req.account.owner))
            return next()
          next({name: 'UnauthorizedError'})
        }
      ])
    ]
  },
  destroy: {
    actions: [
      // only admin can delete a user
      wz.beforeQuery([auth, isAdmin])
    ]
  }
})))

// add Category routes
app.use(wz.router(wz.resource(Category, {
  relations,
  add: {
    actions: [
      wz.beforeQuery([auth, isAdmin])
    ]
  },
  edit: {
    actions: [
      wz.beforeQuery([auth, isAdmin])
    ]
  },
  destroy: {
    actions: [
      wz.beforeQuery([auth, isAdmin])
    ]
  }
})))

// when adding or updating a post we use
// this middleware to set the authenticated
// user as the post writer
const setWriter = (req, res, next) => {
  req.body.writer = req.account.owner
  next()
}

// when editting a post, we check that the authenticated
// user is an admin or the writer of the post.
const isAdminOrPostWriter = (req, res, next) => {
  if (req.account.type === 'admin')
    return next()
  Post.findOne({_id: req.params.id})
  .then(post => {
    if (post && post.writer === req.account.owner)
      next()
    next({name: 'UnauthorizedError'})
  })
  .catch(next)
}

// add Post routes
app.use(wz.router(wz.resource(Post, {
  relations,
  add: {
    actions: [
      wz.beforeQuery([auth, setWriter])
    ]
  },
  edit: {
    actions: [
      wz.beforeQuery([auth, isAdminOrPostWriter, setWriter])
    ]
  },
  destroy: {
    actions: [
      wz.beforeQuery([auth, isAdminOrPostWriter, setWriter])
    ]
  }
})))

// when editting a comment, we check that the authenticated
// user is an admin or the writer of the comment.
const isAdminOrCommentWriter = (req, res, next) => {
  if (req.account.type === 'admin')
    return next()
  Comment.findOne({_id: req.params.id})
  .then(comment => {
    if (comment && comment.writer === req.account.owner)
      next()
    next({name: 'UnauthorizedError'})
  })
  .catch(next)
}

// add Comment routes
app.use(wz.router(wz.resource(Comment, {
  relations,
  add: {
    actions: [
      wz.beforeQuery([auth, setWriter])
    ]
  },
  edit: {
    actions: [
      wz.beforeQuery([auth, isAdminOrCommentWriter, setWriter])
    ]
  },
  destroy: {
    actions: [
      wz.beforeQuery([auth, isAdminOrCommentWriter, setWriter])
    ]
  }
})))

// add Tag routes
app.use(wz.router(wz.resource(Tag, {
  relations,
  add: {
    actions: [
      wz.beforeQuery([auth, isAdmin])
    ]
  },
  edit: {
    actions: [
      wz.beforeQuery([auth, isAdmin])
    ]
  },
  destroy: {
    actions: [
      wz.beforeQuery([auth, isAdmin])
    ]
  }
})))

// simple generic error handler,
// should be imporoved for sure!
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({error: err})
})

const port = process.env.NODE_PORT || 3000

app.listen(port, () => console.log(`Visit http://localhost:${port}/users`))
