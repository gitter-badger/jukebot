var users = {};

module.exports = {
  subscribe: function(req, res) {
    var params = req.allParams();
    var id = req.socket.id;
    req.socket.join('listeners');

    users[id] = params.username || 'Anonymous';
    emitListeners();

    req.socket.on('disconnect', function() {
      delete users[id];
      emitListeners();
    });

    req.socket.on('username', function(d) {
      users[id] = d || 'Anonymous';
      emitListeners();
    });
  },

  add: function(req, res) {
    var params = req.allParams();
    try {
      var key = YouTubeService.parseYouTubeLink(params.link);
      YouTubeService.getYouTubeVideo(key, params.user || 'Anonymous').then(SyncService.addVideo).then(SyncService.sendAddMessages).then(function(video) {
        res.send(200);
      }).catch(function(err) {
        res.send(400, err);
      });
    } catch (err) {
      res.send(400, err);
    }
  },

  remove: function(req, res) {
    var params = req.allParams();
    Video.destroy({
      id: params.id
    }).exec(function(err) {
      Video.publishDestroy(params.id);
      res.send(204);
    });
  }
};

function emitListeners() {
  var io = sails.io;
  io.sockets.in('listeners').emit('listening', {
    users: users
  });
}
