import app from "./app";
import env from "./config/env";

const port = env.PORT;
const isProduction = env.NODE_ENV === "production";

app.listen(port, () => {
    console.log(
        `Server is running on port ${port} in ${isProduction ? "production" : env.NODE_ENV} mode`
    );
});
