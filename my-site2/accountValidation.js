const valid = function (x) {

  const min3max15NN = (test) => {
    return (
      (test === null) ? "feild required" :
        (test.length < 3) ? 'minimum 3 characters required' :
          (test.length > 15) ? 'maximum 15 characters' : null
    )
  }

  const emailRegex = RegExp(
    /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
  );
  const passReq = RegExp(
    /(?=.*[a-z])(?=.*[1-9])[a-zA-Z1-9!?#$%^&*]/
  );

  let formErrors = {
    success: null,
    email: null,
    fName: null,
    lName: null,
    password: null,
    confirm: null
  }

  formErrors.fName = min3max15NN(x.fName);

  formErrors.lName = min3max15NN(x.lName);

  formErrors.email =
    (x.email == null) ?
      "feild required" :
      (!emailRegex.test(x.email)) ?
        "please enter a valid email" :
        null;

  formErrors.password =
    (x.password == null) ?
      "feild required" :
      (!passReq.test(x.password) && x.password.length >= 8 && x.password.length < 15) ?
        "password must contain a combination of numbers and letters" :
        (x.password.length < 7) ?
          "password must be a minimum length of 8" :
          (x.password.length > 15) ?
            "password must be a maximum of 15" :
            null
    ;

  formErrors.confirm =
    (x.password !== null && x.confirm !== x.password) ?
      "Confirm password does not match password" :
      null
    ;


  return formErrors;

}

exports.valid = valid;
