var Promise = require('promise');
var log4js = require('log4js');
var logger = log4js.getLogger();
var SlackWebhook = require('slack-webhook');
var slack = sails.config.globals.slackWebhook ? new SlackWebhook(sails.config.globals.slackWebhook, {
  defaults: {
    username: 'JukeBot'
  }
}) : null;

var videoTimeout;
var autoplay = false;

module.exports = {
  addVideo,
  sendAddMessages,
  skip,
  setAutoplay,
  getAutoplay
};

function addVideo(video) {
  logger.info('Adding video ' + video.key);
  return new Promise(function(resolve, reject) {
    Video.findOne({
      playing: true
    }).exec(function(err, current) {
      if (!current) {
        video.startTime = new Date();
        video.playing = true;
        video.played = true;
        videoTimeout = setTimeout(endCurrentVideo, video.duration);
        video.save(function() {
          resolve(video);
        });
      } else {
        resolve(video);
      }
    });
  });
}

function sendAddMessages(video) {
  return new Promise(function(resolve, reject) {
    Video.publishCreate(video);
    ChatService.addVideoMessage(video.title + ' was added to the playlist by ' + video.user);
    if (slack && sails.config.globals.slackSongPlaying && sails.config.globals.slackSongAdded) {
      sendSlackAddedNotification(video).then(function() {
        resolve(video);
      });
    } else if (video.playing && slack && sails.config.globals.slackSongPlaying ) {
      sendSlackAddedNotification(video).then(function() {
        resolve(video);
      });
    } else if (slack && sails.config.globals.slackSongAdded) {
      sendSlackAddedNotification(video).then(function() {
        resolve(video);
      });
    } else {
      resolve(video);
    }
  });
}

function skip() {
  clearTimeout(videoTimeout);
  endCurrentVideo();
}

function endCurrentVideo() {
  Video.findOne({
    playing: true
  }).exec(function(err, current) {
    current.playing = false;
    current.save(function() {
      logger.info('Publishing end song ' + current.key);
      Video.publishUpdate(current.id, current);
      findNextVideo(current);
    });
  });
}

function findNextVideo(lastVideo) {
  Video.find({
    played: false
  }).sort('createdAt ASC').exec(function(err, upcoming) {
    if (upcoming.length > 0) {
      startVideo(upcoming[0]);
    } else if (autoplay) {
      YouTubeService.nextRelated(lastVideo.key).then(function(nextKey) {
        return YouTubeService.getYouTubeVideo(nextKey, 'Autoplay');
      }).then(addVideo).then(sendAddMessages);
    }
  });
}

function startVideo(video) {
  video.playing = true;
  video.played = true;
  video.startTime = new Date();
  logger.info('Setting timeout');
  videoTimeout = setTimeout(endCurrentVideo, video.duration);
  video.save(() => {
      logger.info('Stopping video ' + video.key);
      Video.publishUpdate(video.id, video);
      ChatService.addVideoMessage(video.title + ' is now playing');
      if (slack && sails.config.globals.slackSongPlaying) {
        sendSlackPlayingNotification(video).then(function() {
          logger.info('Started playing video ' + video.key);
        });
      } else {
        logger.info('Started playing video ' + video.key);
      }
    });
}

function sendSlackAddedNotification(video) {
  return slack.send({
    text: video.user + ' added *' + video.title + '* to the playlist' + (video.playing ? ' and it\'s playing now' : '') + '! <' + sails.config.serverUrl + '|Listen to JukeBot>',
    'mrkdwn': true
  });
}

function sendSlackPlayingNotification(video) {
  return slack.send({
    text: '*' + video.title + '* is now playing! <' + sails.config.serverUrl + '|Listen to JukeBot>',
    'mrkdwn': true
  });
}

function getAutoplay() {
  return autoplay;
}

function setAutoplay(val) {
  autoplay = val;
}
