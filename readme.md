# dolphin testnet v3 faucet

## deployment configuration

this application consists of several components:

### discord/registration

*a nodejs application which registers discord slash commands on the discord server*

### discord/listener

*a continuously running nodejs application which listens for messages and commands from discord*

note: the aws iam policy governing the listener's queue access is at: https://us-east-1.console.aws.amazon.com/iam/home#/policies/arn:aws:iam::684317180556:policy/testnet-v3-faucet$jsonEditor

### lambda

*an aws lambda endpoint which receives discord interactions (messages, commands) and places them in the processor queue*

on first deployment of the lambda, aws will assign it an endpoint url. the discord application responsible for handling commands must be configured with this url in its `interactions endpoint url` field. this can be set in the application configuration console at `https://discord.com/developers/applications/${DISCORD_APPLICATION_ID}/information`, ie: https://discord.com/developers/applications/1054627515160854578/information.

### discord/service

*a systemd service configuration and installer which runs the above nodejs applications*

#### installation

```shell=
#!/usr/bin/env bash

AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DISCORD_APPLICATION_ID=1054627515160854578
DISCORD_GUILD_ID=966219979383013426
DISCORD_BOT_TOKEN=XXXXX_DISCORD_BOT_TOKEN_XXXXX
DOLPHIN_FAUCET_MNEMONIC=this is not really the dolphin faucet mnemonic you should change it
curl -sL https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord/service/install.sh | sudo bash -s ${AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY} ${DISCORD_APPLICATION_ID} ${DISCORD_GUILD_ID} ${DISCORD_BOT_TOKEN} "${DOLPHIN_FAUCET_MNEMONIC}"
```

#### debugging

the discord/service installer also installs promtail (a log forwarder) which is configured to forward the service logs to pulse. the forwarded logs can be seen [here](https://grafana.pulse.pelagos.systems/explore?orgId=1&left=%7B%22datasource%22:%22l2B8SmkVz%22,%22queries%22:%5B%7B%22refId%22:%22A%22,%22datasource%22:%7B%22type%22:%22loki%22,%22uid%22:%22l2B8SmkVz%22%7D,%22editorMode%22:%22builder%22,%22expr%22:%22%7Bhost%3D%5C%22kavula%5C%22,%20unit%3D%5C%22testnet-v3-faucet-discord-listener.service%5C%22%7D%20%7C%3D%20%60%60%22,%22queryType%22:%22range%22%7D%5D,%22range%22:%7B%22from%22:%22now-1h%22,%22to%22:%22now%22%7D%7D).
