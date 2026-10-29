FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node native ./native
USER node
ENV SWARM_DATA=/data
VOLUME ["/data"]
ENTRYPOINT ["node", "native/main.mjs"]
CMD ["inspect"]
