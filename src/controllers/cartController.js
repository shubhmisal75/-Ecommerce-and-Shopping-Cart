const cartModel = require("../models/cartModel");
const validator = require("../validators/validator");
const productModel = require("../models/productModel");
const userModel = require("../models/userModel");

const cartCreation = async (req, res) => {
    try {
        const userId = req.params.userId;
        const requestBody = req.body;
        const { quantity, productId } = requestBody;

        if (!validator.isValidRequestBody(requestBody)) {
            return res.status(400).send({ status: false, message: "Please provide valid request body" });
        }

        if (!validator.isValidObjectId(userId)) {
            return res.status(400).send({ status: false, message: "Please provide valid User Id" });
        }

        if (!validator.isValidObjectId(productId) || !validator.isValid(productId)) {
            return res.status(400).send({ status: false, message: "Please provide valid Product Id" });
        }

        if (!validator.isValid(quantity) || !validator.validQuantity(quantity)) {
            return res.status(400).send({ status: false, message: "Please provide valid quantity & it must be greater than zero." });
        }

        const findUser = await userModel.findById({ _id: userId });

        if (!findUser) {
            return res.status(400).send({ status: false, message: `User doesn't exist by ${userId}` });
        }

        const findProduct = await productModel.findOne({ _id: productId, isDeleted: false });

        if (!findProduct) {
            return res.status(400).send({ status: false, message: `Product doesn't exist by ${productId}` });
        }

        const findCartOfUser = await cartModel.findOne({ userId: userId });

        if (!findCartOfUser) {
            var cartData = {
                userId: userId,
                items: [
                    {
                        productId: productId,
                        quantity: quantity,
                    },
                ],
                totalPrice: findProduct.price * quantity,
                totalItems: 1,
            };
            const createCart = await cartModel.create(cartData);
            return res.status(201).send({ status: true, message: `Cart created successfully`, data: createCart });
        }

        if (findCartOfUser) {

            let price = findCartOfUser.totalPrice + req.body.quantity * findProduct.price;

            let arr = findCartOfUser.items;

            for (i in arr) {
                if (arr[i].productId.toString() === productId) {
                    arr[i].quantity += quantity;

                    let updatedCart = {
                        items: arr,
                        totalPrice: price,
                        totalItems: arr.length,
                    };

                    let responseData = await cartModel.findOneAndUpdate(
                        { _id: findCartOfUser._id },
                        updatedCart,
                        { new: true }
                    );
                    return res.status(200).send({ status: true, message: `Product added successfully`, data: responseData });
                }
            }
            arr.push({ productId: productId, quantity: quantity });

            let updatedCart = {
                items: arr,
                totalPrice: price,
                totalItems: arr.length,
            };

            let responseData = await cartModel.findOneAndUpdate({ _id: findCartOfUser._id }, updatedCart, { new: true });
            return res.status(200).send({ status: true, message: `Product added successfully`, data: responseData });
        }

    } catch (error) {
        res.status(500).send({ status: false, data: error.message });
    }
};


//!......................................................................

const updateCart = async (req, res) => {
    try {
        let userId = req.params.userId;
        let requestBody = req.body;

        if (!validator.isValidObjectId(userId)) {
            return res.status(400).send({ status: false, message: "Invalid userId in body" });
        }

        let user = await userModel.findOne({ _id: userId });

        if (!user) { return res.status(400).send({ status: false, message: "UserId does not exits" }) }

        //! Authorization

        const { cartId, productId, removeProduct } = requestBody;

        if (!validator.isValidRequestBody(requestBody)) {
            return res.status(400).send({ status: false, message: "Invalid request parameters. Please provide cart details." });
        }

        //....cartId

        if (!validator.isValidObjectId(cartId)) {
            return res.status(400).send({ status: false, message: "Invalid cartId in body" });
        }
        let cart = await cartModel.findById({ _id: cartId });

        if (!cart) {
            return res.status(400).send({ status: false, message: "cartId does not exits" });
        }

        //....productId

        if (!validator.isValidObjectId(productId)) {
            return res.status(400).send({ status: false, message: "Invalid productId in body" });
        }

        let product = await productModel.findOne({ _id: productId, isDeleted: false });

        if (!product) {
            return res.status(400).send({ status: false, message: "productId does not exits" });
        }

        //.......find if products exits in cart

        let isProductinCart = await cartModel.findOne({ items: { $elemMatch: { productId: productId } } });

        if (!isProductinCart) {
            return res.status(400).send({ status: false, message: `This ${productId} product does not exits in the cart` });
        }

        //*...... removeProduct validation

        if (!!isNaN(Number(removeProduct))) {
            return res.status(400).send({ status: false, message: `removeProduct should be a valid number either 0 or 1` });
        }
        if (!(removeProduct === 0 || removeProduct === 1)) {
            return res.status(400).send({
                status: false, message: "removeProduct should be 0 (product is to be removed) or 1(quantity has to be decremented by 1) "
            });
        }
        let findQuantity = cart.items.find((x) => x.productId.toString() === productId);

        if (removeProduct === 0) {
            let totalAmount = cart.totalPrice - product.price * findQuantity.quantity; // substract the amount of product*quantity

            await cartModel.findOneAndUpdate({ _id: cartId }, { $pull: { items: { productId: productId } } }, { new: true }); //?pull the product from itmes  //https://stackoverflow.com/questions/15641492/mongodb-remove-object-from-array

            let quantity = cart.totalItems - 1;

            let data = await cartModel.findOneAndUpdate({ _id: cartId }, { $set: { totalPrice: totalAmount, totalItems: quantity } }, { new: true }); //*update the cart with total items and totalprice

            return res.status(200).send({ status: true, message: `${productId} is been removed`, data: data });
        }

        //* decrement quantity

        let totalAmount = cart.totalPrice - product.price;
        let arr = cart.items;
        for (i in arr) {
            if (arr[i].productId.toString() == productId) {
                arr[i].quantity = arr[i].quantity - 1;
                if (arr[i].quantity < 1) {
                    await cartModel.findOneAndUpdate({ _id: cartId }, { $pull: { items: { productId: productId } } }, { new: true });

                    let quantity = cart.totalItems - 1;
                    let data = await cartModel.findOneAndUpdate({ _id: cartId }, { $set: { totalPrice: totalAmount, totalItems: quantity } }, { new: true }); //*update the cart with total items and totalprice

                    //let data = await cartModel.findOneAndUpdate({ _id: cartId }, { $inc: { totalItems: -1 } }, { new: true })
                    return res.status(400).send({ status: false, message: "no such Quantity/Product present in this cart", data: data });
                }
            }
        }
        let data = await cartModel.findOneAndUpdate({ _id: cartId }, { items: arr, totalPrice: totalAmount }, { new: true });
        return res.status(200).send({ status: true, message: `${productId} quantity is been reduced By 1`, data: data });
    } catch (err) {
        return res.status(500).send({ status: false, message: "Error is : " + err });
    }
};

//!................................................................

const getCart = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!validator.isValidObjectId(userId)) {
            return res.status(400).send({ status: false, message: "Invalid userId in params." });
        }
        const findUser = await userModel.findById({ _id: userId });
        if (!findUser) {
            return res.status(400).send({ status: false, message: `User doesn't exists by ${userId} ` });
        }
        const findCart = await cartModel.findOne({ userId: userId }).populate("items.productId", {
            _id: 1,
            title: 1,
            price: 1,
            productImage: 1,
            availableSizes: 1,
        }).select({ _id: 0, createdAt: 0, updatedAt: 0, __v: 0 });

        if (!findCart) {
            return res.status(400).send({ status: false, message: `Cart doesn't exists by ${userId} ` });
        }

        return res.status(200).send({ status: true, message: "Successfully fetched cart.", data: findCart });
    } catch (err) {
        return res.status(500).send({ status: false, message: "Error is : " + err });
    }
};

//!...............................................................

const deleteCart = async  (req, res) => {
    try {
        const userId = req.params.userId;
        if (!validator.isValidObjectId(userId)) {
            return res.status(400).send({ status: false, message: "Invalid userId in params " });
        }
        const findUser = await userModel.findById({ _id: userId });
        //console.log(findUser)
        if (!findUser) {
            return res.status(400).send({ status: false, message: "User does not exits by ${userId}" });
        }
        
        const findCart = await cartModel.findOne({ userId: userId });
        if (!findCart) {
            return res.status(400).send({ status: false, message: "Cart doesn't exits by ${userId}" });
        }
        const deleteCart = await cartModel.findOneAndUpdate({ userId: userId },
            {
                $set: {
                    items: [],
                    totalPrice: 0,
                    totalItems: 0,
                },
            }, { new: true }).select({ items: 1, totalPrice: 1, totalItems: 1, _id: 0 });
        return res.status(204).send({ status: true, message: "Cart deleted successfully", data: deleteCart });

    }
    catch (err) {
        return res.status(500).send({ status: false, message: "Error is :" + err });
    }
}


















module.exports = {
    cartCreation,
    updateCart,
    getCart,
    deleteCart,
};
