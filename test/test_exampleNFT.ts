import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ExampleNFT", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployExampleNFT() {
        const [owner, ...acc] = await ethers.getSigners();

        const ExampleNFTContract = await ethers.getContractFactory(
            "ExampleNFT"
        );
        const contract = await ExampleNFTContract.deploy();
        await contract.connect(owner).flipSaleStatus();

        return { contract, owner, acc };
    }

    describe("Initial values", async function () {
        it("PASS - assigned roles", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);
            expect(
                await contract.hasRole(
                    await contract.PAUSER_ROLE(),
                    owner.address
                )
            ).to.be.true;
            expect(
                await contract.hasRole(
                    await contract.MINTER_ROLE(),
                    owner.address
                )
            ).to.be.true;
            expect(
                await contract.hasRole(
                    await contract.ADMIN_ROLE(),
                    owner.address
                )
            ).to.be.true;
        });
    });

    describe("safeMint()", async function () {
        it("PASS", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);

            for (let i = 1; i < 10; i++) {
                await contract.connect(owner).safeMint(owner.address);
                expect(await contract.ownerOf(i)).to.be.equal(owner.address);
            }
        });

        it("PASS - emit event", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);

            await expect(contract.connect(owner).safeMint(owner.address))
                .to.emit(contract, "MintedNFT")
                .withArgs(owner.address, 1);
            expect(await contract.ownerOf(1)).to.be.equal(owner.address);
        });

        it("PASS - different to address", async function () {
            const { contract, owner, acc } = await loadFixture(
                deployExampleNFT
            );

            await expect(contract.connect(owner).safeMint(acc[0].address))
                .to.emit(contract, "MintedNFT")
                .withArgs(acc[0].address, 1);
            expect(await contract.ownerOf(1)).to.be.equal(acc[0].address);
        });

        it("FAIL - not MINTER_ROLE", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);
            await expect(
                contract.connect(acc[1]).safeMint(acc[1].address)
            ).to.be.revertedWith(
                `AccessControl: account ${String(
                    acc[1].address
                ).toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
            );
        });

        it("FAIL - paused contract", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);
            await contract.connect(owner).pause();

            await expect(
                contract.connect(owner).safeMint(owner.address)
            ).to.be.revertedWith("Pausable: paused");
        });

        it("FAIL - mint over limit", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);

            for (let i = 1; i < 101; i++) {
                await contract.connect(owner).safeMint(owner.address);
                expect(await contract.ownerOf(i)).to.be.equal(owner.address);
            };
            await expect(contract.connect(owner).safeMint(owner.address)).to.be.revertedWith("Mint limit achieved");
        });
    });

    describe("payToMint()", async function () {
        it("PASS", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);
            const mintPrice = ethers.utils.parseEther("0.01");
            const mintPriceMinus = ethers.utils.parseEther("-0.01");

            for (let i = 1; i < 10; i++) {
                await expect(
                    contract
                        .connect(acc[i])
                        .payToMint(acc[i].address, { value: mintPrice })
                ).to.changeEtherBalances(
                    [acc[i], contract],
                    [mintPriceMinus, mintPrice]
                );

                expect(await contract.ownerOf(i)).to.be.equal(acc[i].address);
            }
        });

        it("PASS - different to address", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);
            const mintPrice = ethers.utils.parseEther("0.01");
            const mintPriceMinus = ethers.utils.parseEther("-0.01");

            await expect(
                contract
                    .connect(acc[1])
                    .payToMint(acc[2].address, { value: mintPrice })
            ).to.changeEtherBalances(
                [acc[1], contract],
                [mintPriceMinus, mintPrice]
            );

            expect(await contract.ownerOf(1)).to.be.equal(acc[2].address);
        });

        it("PASS - emit event", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);
            const mintPrice = ethers.utils.parseEther("0.01");

            await expect(
                contract
                    .connect(acc[1])
                    .payToMint(acc[2].address, { value: mintPrice })
            )
                .to.emit(contract, "MintedNFT")
                .withArgs(acc[2].address, 1);

            expect(await contract.ownerOf(1)).to.be.equal(acc[2].address);
        });

        it("FAIL - paused contract", async function () {
            const { contract, owner, acc } = await loadFixture(deployExampleNFT);
            const mintPrice = ethers.utils.parseEther("0.01");

            await contract.connect(owner).flipSaleStatus();

            await expect(
                contract
                    .connect(acc[1])
                    .payToMint(acc[2].address, { value: mintPrice })
            ).to.be.revertedWith("Sale not active");

            await expect(contract.ownerOf(1)).to.be.rejectedWith("ERC721: invalid token ID");
        });

        it("FAIL - paused contract", async function () {
            const { contract, owner, acc } = await loadFixture(deployExampleNFT);
            const mintPrice = ethers.utils.parseEther("0.01");

            await contract.connect(owner).pause();

            await expect(
                contract
                    .connect(acc[1])
                    .payToMint(acc[2].address, { value: mintPrice })
            ).to.be.revertedWith("Pausable: paused");

            await expect(contract.ownerOf(1)).to.be.rejectedWith("ERC721: invalid token ID");
        });

        it("FAIL - send ETH to low", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);
            const mintPriceToLow = ethers.utils.parseEther("0.001");

            await expect(
                contract
                    .connect(acc[1])
                    .payToMint(acc[1].address, { value: mintPriceToLow })
            ).to.be.revertedWith("Send to low ETH to mint NFT");

            await expect(contract.ownerOf(1)).to.be.rejectedWith("ERC721: invalid token ID");
        });

        it("FAIL - mint over limit", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);
            const mintPrice = ethers.utils.parseEther("0.01");

            for (let i = 1; i < 101; i++) {
                await contract.connect(acc[0]).payToMint(acc[0].address, {value: mintPrice});
                expect(await contract.ownerOf(i)).to.be.equal(acc[0].address);
            };
            await expect(contract.connect(acc[1]).payToMint(acc[1].address)).to.be.revertedWith("Mint limit achieved");
        });
    });

    describe("flipSaleStatus()", async function () {
        it("PASS", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);

            expect(await contract.isSaleActive()).to.be.true;
            await contract.connect(owner).flipSaleStatus();
            expect(await contract.isSaleActive()).to.be.false;
        });

        it("FAIL - not ADMIN_ROLE", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);

            expect(await contract.isSaleActive()).to.be.true;
            await expect(contract.connect(acc[0]).flipSaleStatus()).to.be.rejectedWith(`AccessControl: account ${String(
                acc[0].address
            ).toLowerCase()} is missing role 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775`);
            expect(await contract.isSaleActive()).to.be.true;
        });
    });

    describe("pause()", async function () {
        it("PASS", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);

            expect(await contract.paused()).to.be.false;
            await contract.connect(owner).pause();
            expect(await contract.paused()).to.be.true;
        });

        it("FAIL - not PAUSER_ROLE", async function () {
            const { contract, acc } = await loadFixture(deployExampleNFT);

            expect(await contract.paused()).to.be.false;
            await expect(contract.connect(acc[0]).pause()).to.be.rejectedWith(`AccessControl: account ${String(
                acc[0].address
            ).toLowerCase()} is missing role 0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a`);
            expect(await contract.paused()).to.be.false;
        });
    });

    describe("unpause()", async function () {
        it("PASS", async function () {
            const { contract, owner } = await loadFixture(deployExampleNFT);

            await contract.connect(owner).pause();
            expect(await contract.paused()).to.be.true;
            await contract.connect(owner).unpause();
            expect(await contract.paused()).to.be.false;
        });

        it("FAIL - not PAUSER_ROLE", async function () {
            const { contract, owner, acc } = await loadFixture(deployExampleNFT);

            await contract.connect(owner).pause();
            expect(await contract.paused()).to.be.true;
            await expect(contract.connect(acc[0]).unpause()).to.be.rejectedWith(`AccessControl: account ${String(
                acc[0].address
            ).toLowerCase()} is missing role 0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a`);
            expect(await contract.paused()).to.be.true;
        });
    });

    describe("withdraw()", async function () {
        it("PASS", async function () {
            const { contract, owner, acc } = await loadFixture(deployExampleNFT);
            const mintPrice = ethers.utils.parseEther("0.01");
            const mintPriceMinus = ethers.utils.parseEther("-0.01");
            
            await contract.connect(acc[0]).payToMint(acc[0].address, { value: mintPrice });
            await expect(contract.connect(owner).withdraw()).to.changeEtherBalances(
                [contract, owner], 
                [mintPriceMinus, mintPrice]
            );
        });
    });
});
