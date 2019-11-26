import React from 'react';
import { Meteor } from 'meteor/meteor';
import { render } from 'react-dom';
import App from '/imports/ui/App';
import '/imports/client/account';
import 'video-react/dist/video-react.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-s-alert/dist/s-alert-default.css';

Meteor.startup(() => {
  render(<App />, document.getElementById('react-target'));
});
