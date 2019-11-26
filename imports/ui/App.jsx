import React from 'react';
import Hello from './Hello.jsx';
import Alert from 'react-s-alert';

const App = () => (
  <div>
    <Hello />
    <Alert stack={{ limit: 3 }} />
  </div>
);

export default App;
