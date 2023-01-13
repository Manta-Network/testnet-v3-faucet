import { Fragment, useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import Image from 'react-bootstrap/Image';
import Form from 'react-bootstrap/Form';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  //PointElement,
  //LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import Identicon from '@polkadot/react-identicon';
ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  //PointElement,
  //LineElement,
  Title,
  Tooltip,
  Legend
);
const bs58 = require('bs58');
const { encodeAddress, decodeAddress } = require('@polkadot/keyring');
const { u8aToHex } = require('@polkadot/util');
const ss58 = {
  42: 'substrate',
  2: 'kusama',
  8: 'karura',
  78: 'dolphin',
};
const icons = {
  2: 'ksm',
  8: 'kar',
  78: 'dol',
  1285: 'movr',
};
const chains = {
  DOL: { socket: 'wss://ws.calamari.seabird.systems', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/dol.png' },
  KSM: { socket: 'wss://ws.internal.kusama.systems', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/ksm.png' },
  KAR: { socket: 'wss://ws.acala.seabird.systems', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/kar.png' },
  MOVR: { socket: 'wss://ws.moonriver.seabird.systems', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/movr.png' },
}

function Dashboard() {
  const validateAddress = (raw) => {
    try {
      if (raw.slice(0, 2) === '0x') {
        setAddress(raw)
      } else {
        setAddress({
          prefix: bs58.decode(raw)[0],
          decoded: decodeAddress(raw)
        });
      }
    } catch (exception) {
      console.error(exception);
      setAddress(undefined);
    }
  }
  const [health, setHealth] = useState(undefined);
  const [address, setAddress] = useState(undefined);
  const [data, setData] = useState([]);
  const [chartArgs, setChartArgs] = useState(undefined);
  const [history, setHistory] = useState(undefined);
  useEffect(() => {
    if (!!data && !!data.days && !!data.symbols && !!data.colours && !!data.overview) {
      setChartArgs({
        overview: {
          options: {
            plugins: {
              title: {
                display: true,
                text: 'daily faucet disbursements',
                font: {
                  size: 18,
                },
              },
              legend: {
                labels: {
                  font: {
                    size: 18,
                  },
                },
              },
            },
          },
          data: {
            labels: data.days.map((day) => day.toLowerCase()),
            datasets: data.symbols.map((symbol, i) => ({
              label: symbol.toLowerCase(),
              data: data.days.map((day) => (data.overview.find(x => x._id.day === day && x._id.symbol === symbol) || { count: 0 }).count),
              backgroundColor: data.colours[i].background,
              borderColor: data.colours[i].border,
              borderWidth: 1
            })),
          },
        },
      });
    }
  }, [data]);
  useEffect(() => {
    fetch(`https://7m3h5crur1.execute-api.us-east-2.amazonaws.com/dev/observer/overview`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          const overview = container.overview.filter((x) => x.count > 1);
          setData({
            days: [...new Set(overview.map((x) => x._id.day))].sort(),
            symbols: [...new Set(overview.map((x) => x._id.symbol))].sort(),
            colours: [
              {
                background: 'rgba(255, 99, 132, 0.2)',
                border: 'rgb(255, 99, 132)',
              },
              {
                background: 'rgba(255, 205, 86, 0.2)',
                border: 'rgb(255, 205, 86)',
              },
              {
                background: 'rgba(54, 162, 235, 0.2)',
                border: 'rgb(54, 162, 235)',
              },
              {
                background: 'rgba(153, 102, 255, 0.2)',
                border: 'rgb(153, 102, 255)',
              },
            ],
            overview,
          });
        }
      })
      .catch(console.error);
  }, []);
  useEffect(() => {
    if (!!address) {
      if (!!address.decoded) {
        Object.keys(ss58).map((ss58format) => encodeAddress(address.decoded, ss58format)).map((encodedAddress) => {
          fetch(`https://yzoeaaov6a.execute-api.us-east-2.amazonaws.com/prod/observer/address/${encodedAddress}`)
            .then(response => response.json())
            .then((container) => {
              if (!!container.error) {
                console.error(container.error);
              } else {
                setHistory((h) => ({
                  ...h,
                  [encodedAddress]: container.requests,
                }));
              }
            })
            .catch(console.error);
          return null;
        });
      }
    }
  }, [address]);
  useEffect(() => {
    if (!health) {
      fetch(`https://yzoeaaov6a.execute-api.us-east-2.amazonaws.com/prod/observer/health`)
        .then(response => response.json())
        .then((container) => {
          if (!!container.error) {
            console.error(container.error);
          } else {
            setHealth(container);
          }
        })
        .catch(console.error);
    }
  });
  return (
    <Fragment>
      {
        (!!health && !!health.balances)
          ? (
              <Row>
                <h3>
                  remaining faucet drips
                </h3>
                {
                  health.balances.map((faucet) => (
                    <Col key={faucet.symbol}>
                      <h4>
                        {faucet.symbol}
                        <Badge
                          bg={
                            (parseInt(faucet.balance / faucet.drip) > 7000)
                              ? 'success'
                              : (parseInt(faucet.balance / faucet.drip) > 3000)
                                ? 'warning'
                                : 'danger'
                          }
                          style={{marginLeft: '0.5em'}}>
                          {parseInt(faucet.balance / faucet.drip)}
                        </Badge>
                      </h4>
                      balance: {new Intl.NumberFormat().format(faucet.balance)}
                    </Col>
                  ))
                }
              </Row>
            )
          : null
      }
      <Row>
        <h3>
          account lookup
        </h3>
        <Col>
          <Form>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>address</Form.Label>
              <Form.Control type="text" placeholder="enter an account address in substrate (ss58) or moonriver (ethereum) format" onChange={(e) => validateAddress(e.target.value)} />
              <Form.Text className="text-muted">
                moonriver addresses, in <em>ethereum</em> format, usually begin with <code>0x</code>.<br />
                <a href="https://wiki.polkadot.network/docs/learn-account-advanced">substrate addresses</a>, in <em>ss58</em> format, usually begin with:
                <ul>
                  <li><code>5</code> (generic substrate)</li>
                  <li><code>C D, F, G, H, J</code> (kusama/ksm)</li>
                  <li><code>o, p, q, r, s, t</code> (karura/kar)</li>
                  <li><code>dm</code> (calamari/kma, dolphin/dol)</li>
                </ul>
              </Form.Text>
            </Form.Group>
          </Form>
        </Col>
        <Col>
          {
            (!!address)
              ? (!address.decoded && address.slice(0, 2) === '0x')
                ? (
                    <pre>{JSON.stringify({
                      movr: address
                    }, null, 2)}</pre>
                  )
                : (
                    <Fragment>
                      <dl>
                        <dt>public key</dt>
                        <dd>
                          <code style={{marginLeft: '0.5em'}}>
                            {u8aToHex(address.decoded)}
                          </code>
                        </dd>
                        {
                          Object.keys(ss58).reverse().map(prefix => (
                            <Fragment key={prefix}>
                              <dt>
                                {
                                  (['dolphin'].includes(ss58[prefix]))
                                    ? (
                                        <a href={`https://${ss58[prefix]}.subscan.io/account/${encodeAddress(address.decoded, prefix)}`} title="view on subscan" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                                          {
                                            (!!icons[prefix])
                                              ? (
                                                  <Image rounded src={`https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/${icons[prefix]}.png`} style={{ height: '30px', width: '30px', marginRight: '0.5em' }} />
                                                )
                                              : null
                                          }
                                          {ss58[prefix]}
                                        </a>
                                      )
                                    : (
                                        <span>
                                          {
                                            (!!icons[prefix])
                                              ? (
                                                  <Image rounded src={`https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/${icons[prefix]}.png`} style={{ height: '30px', width: '30px', marginRight: '0.5em' }} />
                                                )
                                              : null
                                          }
                                          {ss58[prefix]}
                                        </span>
                                      )
                                }
                              </dt>
                              <dd>
                                <Identicon
                                  value={encodeAddress(address.decoded, prefix)}
                                  size={30}
                                />
                                <code style={{marginLeft: '0.5em'}}>
                                  {encodeAddress(address.decoded, prefix)}
                                </code>
                              </dd>
                            </Fragment>
                          ))
                        }
                      </dl>
                      <p>the substrate addresses above are all equivalent. they are derived from the same seed. they are just encoded with a different network specific prefix.</p>
                    </Fragment>
                  )
              : null
          }
        </Col>
      </Row>
      {
        (!!history)
          ? Object.keys(history).map((encodedAddress) => (
              (!!history[encodedAddress] && !!history[encodedAddress].length)
                ? (
                    <Row key={encodedAddress}>
                      <h3>
                        <Identicon
                          value={encodedAddress}
                          size={30}
                        />
                        <code style={{marginLeft: '0.5em'}}>
                          {encodedAddress}
                        </code>
                      </h3>
                      <Table>
                        <thead>
                          <tr>
                            <th>date</th>
                            <th>symbol</th>
                            <th>status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {
                            history[encodedAddress].map((request) => (
                              <tr key={request.day}>
                                <td>{request.day}</td>
                                <td>{request.symbol}</td>
                                <td>
                                  {
                                    (!!request.finalized)
                                      ? (
                                          <a href={`https://polkadot.js.org/apps/?rpc=${chains[request.symbol].socket}#/explorer/query/${request.finalized.hash}`}>
                                            finalized
                                          </a>
                                        )
                                      : (!!request.block)
                                        ? (
                                            <a href={`https://polkadot.js.org/apps/?rpc=${chains[request.symbol].socket}#/explorer/query/${request.block.hash}`}>
                                              processed
                                            </a>
                                          )
                                        : null
                                  }
                                </td>
                              </tr>
                            ))
                          }
                          <tr>
                            <th>date</th>
                            <th>symbol</th>
                            <th>status</th>
                          </tr>
                        </tbody>
                      </Table>
                    </Row>
                  )
                : null
            ))
          : null
      }
      <Row>
        <h2>
          faucet disbursement stats
        </h2>
      </Row>
      {
        (!!chartArgs)
          ? Object.keys(chartArgs).map(key => (
              <Row key={key}>
                <Bar id={key} {...chartArgs[key]} />
              </Row>
            ))
          : (
              <Spinner animation="border" variant="secondary" size="sm">
                <span className="visually-hidden">daily faucet disbursement lookup in progress...</span>
              </Spinner>
            )
        
      }
      {
        (!!data && !!data.overview && !!data.overview.length)
          ? (
              <Table>
                <thead>
                  <tr>
                    <th></th>
                    {
                      data.symbols.map((symbol, i) => (
                        <th key={symbol} style={{ textAlign: 'right', backgroundColor: data.colours[i].background }}>
                          {symbol.toLowerCase()}
                          <Image rounded src={`https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/${symbol.toLowerCase()}.png`} style={{ height: '30px', width: '30px', marginLeft: '0.5em' }} />
                        </th>
                      ))
                    }
                  </tr>
                </thead>
                <tbody>
                  {
                    data.days.map((day) => (
                      <tr key={day}>
                        <th style={{ textAlign: 'right' }}>{day}</th>
                        {
                          data.symbols.map((symbol, i) => (
                            <td key={symbol} style={{ textAlign: 'right'}}>
                              {(data.overview.find((x) => x._id.day === day && x._id.symbol === symbol) || { count: 0 }).count}
                            </td>
                          ))
                        }
                      </tr>
                    ))
                  }
                </tbody>
              </Table>
            )
          : null
      }
    </Fragment>
  );
}

export default Dashboard;
