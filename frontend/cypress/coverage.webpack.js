module.exports = {
    module: {
        rules: [
            {
                enforce: 'post',
                test: /\.(js|ts)$/,
                use: [
                    {
                        loader: '@jsdevtools/coverage-istanbul-loader',
                        options: {
                            esModules: true
                        }
                    }
                ],
                exclude: /node_modules/
            }
        ]
    }
};
