import { Meteor } from 'meteor/meteor';
import React, { Component } from 'react';
import BigNumber from 'bignumber.js';
import { account } from '/imports/client/account';
import { Channel, Crypto, Universal } from '@aeternity/aepp-sdk';
import { Player } from 'video-react';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Badge from 'react-bootstrap/Badge';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Modal from 'react-bootstrap/Modal';
import Alert from 'react-s-alert';

function clearChannelStorage() {
  localStorage.removeItem('channel');
  localStorage.removeItem('round');
}

async function createChannel(acc) {
  const existingChannel = localStorage.getItem('channel');
  if (existingChannel) {
    return reconnectChannel(acc, JSON.parse(existingChannel));
  }

  const sharedParams = await new Promise(async (resolve, reject) => {
    Meteor.call(
      'createChannel',
      await acc.address(),
      BigNumber('20e18').toString(),
      (err, sharedParams) => {
        if (err) {
          return reject(err);
        }
        return resolve(sharedParams);
      }
    )
  });
  const channel = await Channel({
    ...sharedParams,
    role: 'responder',
    sign(tag, tx) {
      console.log(tag, tx);
      return acc.signTransaction(tx);
    }
  });
  window.channel = channel;
  channel.on('statusChanged', (status) => {
    if (status === 'open') {
      localStorage.setItem('channel', JSON.stringify({
        params: sharedParams,
        id: channel.id()
      }));
    }
  });
  channel.on('stateChanged', (status) => {
    localStorage.setItem('round', channel.round());
  });

  return channel;
}

async function reconnectChannel(acc, params) {
  await new Promise(async (resolve, reject) => {
    Meteor.call(
      'reconnectChannel',
      await acc.address(),
      params.id,
      localStorage.getItem('round'),
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    )
  });
  const ch = await Channel.reconnect({
    ...params.params,
    role: 'responder',
    sign(tag, tx) {
      console.log(tag, tx);
      return acc.signTransaction(tx);
    }
  }, {
    channelId: params.id,
    round: localStorage.getItem('round'),
    role: 'responder',
    pubkey: await acc.address()
  });
  return ch;
}

export default class Hello extends Component {
  state = {
    status: null,
    channel: null,
    account: null,
    address: null,
    ready: false,
    depositAmount: 10,
    showDepositModal: false,
    withdrawAmount: 10,
    showWithdrawModal: false,
    showSettingsModal: false,
    publicKey: Meteor.settings.public.publicKey,
    privateKey: Meteor.settings.public.secretKey,
  }

  async updateBalance() {
    const { channel, address } = this.state;
    if (channel) {
      this.setState({
        balance: (await channel.balances([address]))[address],
      });
    }
  }

  deposit = async () => {
    const { channel, account, depositAmount } = this.state;
    const amount = BigNumber(depositAmount).multipliedBy('1e18').toString();
    try {
      const result = await channel.deposit(amount, tx => account.signTransaction(tx));
      if (result.accepted) {
        Alert.success(`Succesfully deposited ${BigNumber(amount).dividedBy('1e18')} ae`, {
          position: 'bottom-right'
        });
      }
    } catch (err) {
      Alert.error(`Error: ${err.message}`, { position: 'bottom-right' });
    } finally {
      this.setState({
        showDepositModal: false
      });
    }
  }

  withdraw = async () => {
    const { channel, account, withdrawAmount } = this.state;
    const amount = BigNumber(withdrawAmount).multipliedBy('1e18').toString();
    try {
      const result = await channel.withdraw(amount, tx => account.signTransaction(tx));
      if (result.accepted) {
        Alert.success(`Succesfully withdrawed ${BigNumber(amount).dividedBy('1e18')} ae`, {
          position: 'bottom-right'
        });
      }
    } catch (err) {
      Alert.error(`Error: ${err.message}`, { position: 'bottom-right' });
    } finally {
      this.setState({
        showWithdrawModal: false
      });
    }
  }

  closeChannel = async () => {
    const { channel, account } = this.state;
    clearChannelStorage()
    const tx = await channel.shutdown(tx => account.signTransaction(tx));
    Alert.info(`Close tx: ${tx}`, { position: 'bottom-right' });
    this.setState({ balance: 0 });
    channel.disconnect();
  }

  updateSettings = async () => {
    try {
      const { publicKey, privateKey, channel } = this.state;
      if (
        !Crypto.isValidKeypair(
          Buffer.from(privateKey, 'hex'),
          Crypto.decodeBase58Check(publicKey.substr(3)))
      ) {
        return Alert.error('Invalid keypair', { position: 'bottom-right' });
      }
      channel.disconnect();
      clearChannelStorage();
      localStorage.setItem('keypair', JSON.stringify({ publicKey, privateKey }));
      this.setState({ showSettingsModal: false });
    } catch (err) {
      Alert.error(`Error: ${err.message}`, { position: 'bottom-right' });
    }
  }

  async componentDidMount() {
    // const acc = await account();
    let acc;
    const keypair = localStorage.getItem('keypair');
    if (keypair) {
      const { publicKey, privateKey } = JSON.parse(keypair)
      acc = await Universal({
        url: Meteor.settings.public.nodeUrl,
        internalUrl: Meteor.settings.public.nodeInternalUrl,
        networkId: Meteor.settings.public.networkId,
        keypair: {
          publicKey: publicKey,
          secretKey: privateKey
        }
      })
    } else {
      acc = await account();
    }
    const channel = await createChannel(acc);
    this.setState({
      channel,
      account: acc,
      address: await acc.address(),
    });

    channel.on('statusChanged', (status) => {
      this.setState({ status });
      if (status === 'open') {
        this.setState({
          ready: true
        })
      }
    });

    channel.on('stateChanged', () => {
      this.updateBalance();
    });
  }

  render() {
    const {
      status,
      address,
      balance,
      channel,
      ready,
      depositAmount,
      showDepositModal,
      withdrawAmount,
      showWithdrawModal,
      publicKey,
      privateKey,
      showSettingsModal
    } = this.state;
    const chId = localStorage.getItem('channel') ? JSON.parse(localStorage.getItem('channel')).id : null;

    return (
      <div>
        <Navbar bg="light" expand="lg">
          <Navbar.Brand href="#home">PayPerFrame</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mr-auto">
              {/* <Nav.Link href="#home">Home</Nav.Link> */}
            </Nav>
            <Form inline>
              <div style={{ marginTop: 6 }}>
                <Badge
                  variant={{
                    open: 'success',
                    disconnected: 'danger'
                  }[status] || 'primary'}
                >
                  {status}
                </Badge>
              </div>
              {balance != null &&
                <div style={{ marginTop: 6 }}>
                  <Badge>{BigNumber(balance).dividedBy('1e18').toPrecision(5)} ae</Badge>
                </div>
              }
              <ButtonGroup style={{ marginLeft: 30 }}>
                <Button
                  variant="secondary"
                  onClick={() => this.setState({ showDepositModal: true })}
                >
                  Deposit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => this.setState({ showWithdrawModal: true })}
                >
                  Withdraw
                </Button>
                <Button
                  variant="danger"
                  onClick={this.closeChannel}
                >
                  Close channel
                </Button>
                <Button
                  variant="dark"
                  onClick={() => this.setState({ showSettingsModal: true })}
                >
                  Settings
                </Button>
              </ButtonGroup>
            </Form>
          </Navbar.Collapse>
        </Navbar>
        {/* <div
          style={{
            position: 'fixed',
            top: 0,
            width: 800,
            backgroundColor: '#fff',
            zIndex: 200
          }}>
          <h4>CHANNEL STATUS: {status}</h4>
          <h4>BALANCE: {balance}</h4>
          <h4>ACCOUNT: {address}</h4>
        </div> */}
        <Container style={{ marginTop: 20 }}>
          {ready &&
            <div>
            <Row>
              <Col>
                <div style={{ marginBottom: 15 }}>
                  <Player
                    src={`/stream?file=video.mp4&channelId=${chId}`}
                    poster="video.mp4.png"
                    preload="none"
                  />
                </div>
              </Col>
              <Col>
                <div style={{ marginBottom: 15 }}>
                  <Player
                    src={`/stream?file=video2.mp4&channelId=${chId}`}
                    poster="video2.mp4.png"
                    preload="none"
                  />
                </div>
              </Col>
            </Row>
            <Row>
              <Col>
                <div style={{ marginBottom: 15 }}>
                  <Player
                    src={`/stream?file=video3.mp4&channelId=${chId}`}
                    poster="video3.mp4.png"
                    preload="none"
                  />
                </div>
              </Col>
              <Col>
                <div style={{ marginBottom: 15 }}>
                  <Player
                    src={`/stream?file=video4.mp4&channelId=${chId}`}
                    poster="video4.mp4.png"
                    preload="none"
                  />
                </div>
              </Col>
            </Row>
            <Row>
              <Col>
                <div style={{ marginBottom: 15 }}>
                  <Player
                    src={`/stream?file=video5.mp4&channelId=${chId}`}
                    poster="video5.mp4.png"
                    preload="none"
                  />
                </div>
              </Col>
              <Col>
                <div style={{ marginBottom: 15 }}>
                  <Player
                    src={`/stream?file=video6.mp4&channelId=${chId}`}
                    poster="video6.mp4.png"
                    preload="none"
                  />
                </div>
              </Col>
            </Row>
            </div>
          }
        </Container>

        <Modal show={showDepositModal} onHide={() => this.setState({ showDepositModal: false })}>
          <Modal.Header closeButton>
            <Modal.Title>Deposit tokens</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Amount</Form.Label>
              <Form.Control
                type="number"
                onChange={(e) => this.setState({ depositAmount: e.target.value })}
                value={depositAmount}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => this.setState({ showDepositModal: false })}>
              Cancel
            </Button>
            <Button variant="primary" onClick={this.deposit}>
              Deposit
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showWithdrawModal} onHide={() => this.setState({ showWithdrawModal: false })}>
          <Modal.Header closeButton>
            <Modal.Title>Withdraw tokens</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Amount</Form.Label>
              <Form.Control
                type="number"
                onChange={(e) => this.setState({ withdrawAmount: e.target.value })}
                value={withdrawAmount}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => this.setState({ showWithdrawModal: false })}>
              Cancel
            </Button>
            <Button variant="danger" onClick={this.withdraw}>
              Withdraw
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showSettingsModal} onHide={() => this.setState({ showSettingsModal: false })}>
          <Modal.Header closeButton>
            <Modal.Title>Settings</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Public key</Form.Label>
              <Form.Control
                type="text"
                onChange={(e) => this.setState({ publicKey: e.target.value })}
                value={publicKey}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Private key</Form.Label>
              <Form.Control
                type="text"
                onChange={(e) => this.setState({ privateKey: e.target.value })}
                value={privateKey}
              />
              <Form.Text className="text-muted">
                We'll never share your private key nor store it on the server.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => this.setState({ showSettingsModal: false })}>
              Cancel
            </Button>
            <Button variant="primary" onClick={this.updateSettings}>
              Update
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}
