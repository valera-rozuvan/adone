describe("net", "http", "server", "context", "state", () => {
    const { net: { http: { server: { Server } } } } = adone;

    it("should provide a ctx.state namespace", async () => {
        const server = new Server();

        server.use((ctx) => {
            assert.deepEqual(ctx.state, {});
        });

        await request(server)
            .get("/")
            .expectStatus(404);
    });
});
