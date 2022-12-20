#!/usr/bin/env bash

# install promtail.service (to forward service logs)

unit=promtail.service
unit_path=/etc/systemd/system
unit_url=https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord-listener/${unit}
config=promtail.yml
config_path=/etc/promtail
config_url=https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord-listener/${config}

if [ -s ${unit_path}/${unit} ]; then
  systemctl is-active ${unit} && sudo systemctl stop ${unit}
  test -x /usr/local/bin/promtail-linux-amd64 || ( curl -Lo /tmp/promtail-linux-amd64.zip https://github.com/grafana/loki/releases/download/v2.6.1/promtail-linux-amd64.zip && sudo unzip /tmp/promtail-linux-amd64.zip -d /usr/local/bin )
  sudo mkdir -p ${config_path}
  sudo curl -Lo ${config_path}/${config} ${config_url}
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo systemctl daemon-reload
  systemctl is-enabled ${unit} || sudo systemctl enable ${unit}
  sudo systemctl start ${unit}
else
  test -x /usr/local/bin/promtail-linux-amd64 || ( curl -Lo /tmp/promtail-linux-amd64.zip https://github.com/grafana/loki/releases/download/v2.6.1/promtail-linux-amd64.zip && sudo unzip /tmp/promtail-linux-amd64.zip -d /usr/local/bin )
  sudo mkdir -p ${config_path}
  sudo curl -Lo ${config_path}/${config} ${config_url}
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo systemctl enable --now ${unit}
fi


# install testnet-v3-faucet-discord-listener.service

unit=testnet-v3-faucet-discord-listener.service
unit_path=/etc/systemd/system
unit_url=https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord-listener/${unit}

if [ "${#1}" = "19" ] && [ "${#2}" = "72" ]; then
  DISCORD_APPLICATION_ID=${1}
  DISCORD_BOT_TOKEN=${2}
else
  echo "usage:"
  echo "\$ curl -sL https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord-listener/install-testnet-v3-faucet-discord-listener.sh | sudo bash -s DISCORD_APPLICATION_ID DISCORD_BOT_TOKEN"
  exit 1
fi

if [ -s ${unit_path}/${unit} ]; then
  systemctl is-active ${unit} && sudo systemctl stop ${unit}
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo sed -i "s/\${DISCORD_APPLICATION_ID}/${DISCORD_APPLICATION_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_BOT_TOKEN}/${DISCORD_BOT_TOKEN}/" ${unit_path}/${unit}
  sudo systemctl daemon-reload
  systemctl is-enabled ${unit} || sudo systemctl enable ${unit}
  sudo systemctl start ${unit}
else
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo sed -i "s/\${DISCORD_APPLICATION_ID}/${DISCORD_APPLICATION_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_BOT_TOKEN}/${DISCORD_BOT_TOKEN}/" ${unit_path}/${unit}
  sudo systemctl enable --now ${unit}
fi
