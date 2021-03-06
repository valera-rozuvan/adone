import { createConnection } from "../../common";

describe("database", "mysql", "functional", "connection", "prepare and execute", () => {
    let connection = null;

    before(async () => {
        connection = await createConnection();
    });

    after(async () => {
        if (connection) {
            await connection.end();
        }
    });

    it("should work", async () => {
        const s = await connection.prepare("select 1 + ? + ? as test");
        const [rows, columns] = await s.execute([111, 123]);
        expect(s.columns).to.have.lengthOf(1);
        expect(s.parameters).to.have.lengthOf(2);
        expect(rows).to.be.deep.equal([{ test: 235 }]);
        expect(columns[0].name).to.be.equal("test");
    });
});
