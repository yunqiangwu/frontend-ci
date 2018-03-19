import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Row, Col, Button, Modal, Input, Card, Table, message, Tabs } from "antd";
import { stringify } from "qs";

import config from "./config";
import utils from "./utils";

import styles from "./api.less";

const { TextArea } = Input;
const TabPane = Tabs.TabPane;
/* eslint no-underscore-dangle:0 */

const { port, isStatic, docPort } = config;
const { isObject, parseKey, handleRequest } = utils;

const quickCommand = [
  {
    name: '拉取最新代码',
    shell: 'git pull',
  },
  {
    name: '编译生成版本',
    shell: 'mkdir -p dist_history && tar cvf dist_history/dist_`date +%Y%m%d%H%M%S`.tar dist && npm run build',
  },
];

class ApiItem extends Component {
  
  render() {
    
    return (
      <Card
        className={styles.apiItem}
        title={
          <p className={styles.apiItemTitle}>
            title1
          </p>
        }
      >
       content
      </Card>
    );
  }
}

// eslint-disable-next-line
class ApiDoc extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theMockData: {},
      modalVisible: false
    };
  }

  handleShowData = data => {
    this.setState({
      theMockData: data,
      modalVisible: true
    });
  };

  handleModalCancel = () => {
    this.setState({
      modalVisible: false
    });
  };

  render() {
    const { modalVisible, theMockData } = this.state;
    return (
      <div className={styles.apiDoc}>
        <h1>控制台200</h1>
        <Row>
          <Col md={16} xs={24}>
          <Tabs defaultActiveKey="1" >
            <TabPane tab="Tab 1" key="1">Content of Tab Pane 1</TabPane>
            <TabPane tab="Tab 2" key="2">Content of Tab Pane 2</TabPane>
            <TabPane tab="Tab 3" key="3">Content of Tab Pane 3</TabPane>
          </Tabs>
          </Col>
        </Row>
      </div>
    );
  }
}

ReactDOM.render(<ApiDoc />, document.body);
