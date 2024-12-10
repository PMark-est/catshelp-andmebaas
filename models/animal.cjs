"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Animal extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Animal.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: DataTypes.STRING,
      birthday: DataTypes.DATE,
      description: DataTypes.STRING,
      status: DataTypes.STRING,
      chip_number: DataTypes.STRING,
      chip_registered_with_us: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Animal",
    }
  );
  return Animal;
};