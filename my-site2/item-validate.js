const validate = (x) => {
  let formErrors = {};

  const minmaxString = (test) => {
    return test === null || test.length < 1
      ? "feild required"
      : test.length < 3
      ? "minimum 3 characters required"
      : null;
  };
  const minmaxNum = (test) => {
    return test === null
      ? "feild required"
      : test < 0.01
      ? "Number must be Greater than 0"
      : null;
  };
  formErrors.name = minmaxString(x.name);
  formErrors.title = minmaxString(x.title);
  formErrors.price = minmaxNum(x.price);
  formErrors.amount = minmaxNum(x.amount);
  formErrors.weight = minmaxNum(x.weight);
  return formErrors;
};
module.exports = { validate };
