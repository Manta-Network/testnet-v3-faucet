#!/usr/bin/env bash

# install promtail.service (to forward service logs)

unit=promtail.service
unit_path=/etc/systemd/system
unit_url=https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord/service/${unit}
config=promtail.yml
config_path=/etc/promtail
config_url=https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord/service/${config}

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
unit_url=https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord/service/${unit}

if [ "${#1}" = "20" ] && [ "${#2}" = "40" ] && [ "${#3}" = "19" ] && [ "${#4}" = "19" ] && [ "${#5}" = "72" ]; then
  AWS_ACCESS_KEY_ID=${1}
  AWS_SECRET_ACCESS_KEY=${2}
  DISCORD_APPLICATION_ID=${3}
  DISCORD_GUILD_ID=${4}
  DISCORD_BOT_TOKEN=${5}
  DOLPHIN_FAUCET_MNEMONIC=${6}
else
  echo "usage:"
  echo '$ AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX'
  echo '$ AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  echo '$ DISCORD_APPLICATION_ID=1054627515160854578'
  echo '$ DISCORD_GUILD_ID=1054619758336675910'
  echo '$ DISCORD_BOT_TOKEN=XXXXX_DISCORD_BOT_TOKEN_XXXXX'
  echo '$ DOLPHIN_FAUCET_MNEMONIC=this is not really the dolphin faucet mnemonic you should change it'
  echo '$ curl -sL https://raw.githubusercontent.com/Manta-Network/testnet-v3-faucet/main/discord/service/install.sh | sudo bash -s ${AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY} ${DISCORD_APPLICATION_ID} ${DISCORD_GUILD_ID} ${DISCORD_BOT_TOKEN} "${DOLPHIN_FAUCET_MNEMONIC}"'
  exit 1
fi

if [ -s ${unit_path}/${unit} ]; then
  systemctl is-active ${unit} && sudo systemctl stop ${unit}
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo sed -i "s/\${AWS_ACCESS_KEY_ID}/${AWS_ACCESS_KEY_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${AWS_SECRET_ACCESS_KEY}/${AWS_SECRET_ACCESS_KEY}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_APPLICATION_ID}/${DISCORD_APPLICATION_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_GUILD_ID}/${DISCORD_GUILD_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_BOT_TOKEN}/${DISCORD_BOT_TOKEN}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DOLPHIN_FAUCET_MNEMONIC}/${DOLPHIN_FAUCET_MNEMONIC}/" ${unit_path}/${unit}
  sudo systemctl daemon-reload
  systemctl is-enabled ${unit} || sudo systemctl enable ${unit}
  sudo systemctl start ${unit}
else
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo sed -i "s/\${AWS_ACCESS_KEY_ID}/${AWS_ACCESS_KEY_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${AWS_SECRET_ACCESS_KEY}/${AWS_SECRET_ACCESS_KEY}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_APPLICATION_ID}/${DISCORD_APPLICATION_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_GUILD_ID}/${DISCORD_GUILD_ID}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DISCORD_BOT_TOKEN}/${DISCORD_BOT_TOKEN}/" ${unit_path}/${unit}
  sudo sed -i "s/\${DOLPHIN_FAUCET_MNEMONIC}/${DOLPHIN_FAUCET_MNEMONIC}/" ${unit_path}/${unit}
  sudo systemctl enable --now ${unit}
fi
